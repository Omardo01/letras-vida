import { useCallback, useEffect, useRef, useState } from "react";
import {
  autoFullscreenAllowed,
  defaultSelection,
  loadScreenPlan,
  saveScreenPlan,
  watchScreens,
  windowManagementState,
  type DetectedScreen,
  type ScreenPlan,
  type WindowManagementState,
} from "../lib/screens";

/**
 * Monitores conectados y la configuración de pantallas guardada. Con el permiso
 * ya concedido los monitores aparecen solos; si no, `detect` lo pide.
 */
export function useScreens() {
  const [perm, setPerm] = useState<WindowManagementState | null>(null);
  const [screens, setScreens] = useState<DetectedScreen[] | null>(null);
  const [autoFs, setAutoFs] = useState(false);
  const [plan, setPlanState] = useState<ScreenPlan | null>(loadScreenPlan);
  const stop = useRef<(() => void) | null>(null);
  const screensRef = useRef(screens);
  screensRef.current = screens;

  const setPlan = useCallback((next: ScreenPlan) => {
    setPlanState(next);
    saveScreenPlan(next);
  }, []);

  /** Pide (si hace falta) el permiso y empieza a seguir los monitores; devuelve la lista o null. */
  const detect = useCallback(async (): Promise<DetectedScreen[] | null> => {
    try {
      stop.current?.();
      let latest: DetectedScreen[] = [];
      stop.current = await watchScreens((list) => {
        latest = list;
        setScreens(list);
      });
      setPerm("granted");
      // Primera vez: propone como salida todo menos la pantalla del control.
      setPlanState((prev) => {
        if (prev?.selected.length) return prev;
        const next: ScreenPlan = { selected: defaultSelection(latest, prev), mode: prev?.mode ?? "joined", autoStart: prev?.autoStart };
        saveScreenPlan(next);
        return next;
      });
      return latest;
    } catch {
      setPerm(await windowManagementState());
      return null;
    }
  }, []);

  /** Los monitores de ahora, detectándolos si aún no se ha hecho. */
  const current = useCallback(async () => screensRef.current ?? detect(), [detect]);

  useEffect(() => {
    windowManagementState().then((state) => {
      setPerm(state);
      if (state === "granted") detect();
    });
    autoFullscreenAllowed().then(setAutoFs);
    return () => stop.current?.();
  }, [detect]);

  return { perm, screens, autoFs, plan, setPlan, detect, current };
}
