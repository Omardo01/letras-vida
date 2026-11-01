import { useCallback, useEffect, useRef, useState } from "react";
import { moveMonitorCalibration } from "../lib/live";
import {
  autoFullscreenAllowed,
  defaultSelection,
  loadScreenPlan,
  resolvePlan,
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
  const planRef = useRef(plan);
  planRef.current = plan;

  const setPlan = useCallback((next: ScreenPlan) => {
    planRef.current = next;
    setPlanState(next);
    saveScreenPlan(next);
  }, []);

  /**
   * Si Windows reacomodó las teles (o el adaptador cambió de resolución), la
   * configuración y el ajuste fino de cada una pasan a su identidad nueva.
   * Devuelve la configuración ya al día.
   */
  const heal = useCallback(
    (list: DetectedScreen[]) => {
      const p = planRef.current;
      if (!p) return p;
      const { remap } = resolvePlan(list, p);
      if (!remap.length) return p;
      for (const [from, to] of remap) moveMonitorCalibration(from, to);
      const next = { ...p, selected: p.selected.map((k) => remap.find(([from]) => from === k)?.[1] ?? k) };
      setPlan(next);
      return next;
    },
    [setPlan],
  );

  /** Pide (si hace falta) el permiso y empieza a seguir los monitores; devuelve la lista o null. */
  const detect = useCallback(async (): Promise<DetectedScreen[] | null> => {
    try {
      stop.current?.();
      let latest: DetectedScreen[] = [];
      stop.current = await watchScreens((list) => {
        latest = list;
        setScreens(list);
        heal(list);
      });
      setPerm("granted");
      // Primera vez: propone como salida todo menos la pantalla del control.
      const prev = planRef.current;
      if (!prev?.selected.length) setPlan({ selected: defaultSelection(latest, prev), mode: prev?.mode ?? "joined", autoStart: prev?.autoStart });
      return latest;
    } catch {
      setPerm(await windowManagementState());
      return null;
    }
  }, [heal, setPlan]);

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

  return { perm, screens, autoFs, plan, setPlan, detect, current, heal };
}
