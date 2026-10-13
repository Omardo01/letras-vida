# Versículos

Web app para los domingos: pegas las citas que manda el pastor y descargas los
slides listos para ProPresenter — PNG a la resolución de las pantallas y, si
quieres, un MP4 por versículo con la animación de entrada. Todo se genera en el
navegador; no hay servidor ni cuenta.

## Uso

1. Pega el mensaje tal cual llega (`Juan 3:16`, `Sal 23.1-3`, `1 Co 13:4-7`,
   `Mateo 5:3-6, 9; 6:1`…). Las líneas que no son citas se vuelven slides de
   título con el mismo diseño.
2. Elige versión: RVR60, LBLA y/o NBLA (varias a la vez → un slide por versión).
3. Revisa la vista previa; puedes editar el texto o la cita de cada slide y
   reproducir la animación.
4. *Descargar ZIP*: carpeta `png/`, carpeta `mp4/` (opcional) y
   `propresenter.txt` (un párrafo por slide, por si prefieres importar texto y
   usar tu tema de ProPresenter).

En ProPresenter arrastra las imágenes o videos a la presentación; con el modo
*Entrada y se queda*, configura el video en *hold last frame* y cambia de slide
con la transición de ProPresenter.

## Modo en vivo (invitados que no mandan citas)

El control vive en su propia ventana, **`/envivo`** (botón *Abrir control en
vivo* en la página principal), para no mezclarlo con la preparación de los
slides. Muestra las *Citas de hoy* (las pegadas en la página principal) como
botones de un clic, y la pestaña *Fondos*.

1. En la PC de salida abre `/envivo` y, en **⚙ Pantallas**, pulsa *Abrir
   salida* (o abre `/live` en otra ventana). Llévala a la pantalla
   del proyector y pulsa **F** (pantalla completa). También puedes mostrarla
   dentro de ProPresenter como objeto web (icono HTML del editor) apuntando a
   `https://letrasvida.vercel.app/live` con *Continuous Render* — pero ojo:
   el WebView de ProPresenter es otro navegador, así que para controlarlo hace
   falta el relevo remoto (ver abajo).
2. Teclea la cita y Enter: aparece con la animación de entrada. `←`/`→`
   avanzan versículo a versículo (aunque te salgas de lo tecleado), los
   botones numerados saltan a cualquier versículo del capítulo, `‹ cap.` /
   `cap. ›` cambian de capítulo y **Esc** o *Limpiar* deja la pantalla en
   blanco. Cualquier slide de la lista tiene también un botón *En vivo*.
3. Cambios de diseño se reflejan en la salida al instante.

### Pantallas unidas, nombres y reposo

*⚙ Pantallas* abre 1, 2 o 3 ventanas de salida que juntas forman una sola
pantalla ancha (cada una dibuja su tramo de la composición 7680×2160). La
lista *Ya abiertas* muestra cada ventana con su resolución, un **nombre
editable** ("LED izquierda"), un selector de tramo y *Identificar* (rótulo
grande con número y nombre). Cada ventana tiene también un ⚙ propio (abajo a la
izquierda al mover el ratón) y atajos `1`/`2`/`3`/`U`; recuerda su nombre y
tramo. *Cuando no hay versículo*: negro, fondo del diseño, logo o logo sobre
negro.

### Fondos de pantalla

Pestaña *Fondos* de `/envivo`. Vienen tres incluidos (Aurora azul, Bokeh,
Estrellas — `public/backgrounds/`, generados con Remotion en
`tecnolutions/animaciones/remotion-intro/src/Fondos.tsx`, bucle perfecto de
20 s a 1920×540) y puedes subir los tuyos (se guardan en IndexedDB del
navegador de la PC de salida). Eliges uno y las ventanas lo
reproducen en bucle detrás del versículo, partido entre las pantallas y
arrancando en el mismo punto. Con fondo activo el diseño se dibuja con fondo
transparente. Recomendado: MP4 H.264 ≤ 100 MB.

Hoy el control y la salida se comunican dentro del **mismo navegador**
(`BroadcastChannel`). Controlar desde el celular o desde el WebView de
ProPresenter requiere un relevo (Upstash Redis en Vercel o similar); está
previsto pero no incluido.

## Diseño

El panel *Diseño* cambia colores, fuente, tamaños, logo y fondo (blanco o
transparente). Se guarda en el navegador. *Restablecer diseño original* vuelve
al look de referencia (píldora `#03acdb`, caja `#1178bc`, Open Sans Bold).

## Desarrollo

```bash
bun install
bun run dev
bun run build     # dist/ estático, listo para Vercel/Netlify/cualquier hosting
bunx vitest run   # tests del parser de citas
```

Las biblias vienen de los snapshots JSON de [mrk214/bible-data-es-spa](https://github.com/mrk214/bible-data-es-spa)
(`data/`, no versionado) y se convierten al formato compacto de `public/bibles/`
con `python3 scripts/build-bibles.py`.

## Cómo funciona

- `src/lib/references.ts` — parser de citas en español: abreviaturas, libros
  numerados (`1 Co`, `Primera de Corintios`, `I Juan`), rangos, listas,
  varios capítulos y rangos que cruzan capítulo.
- `src/lib/slides.ts` — resuelve los versículos y parte los pasajes largos por
  número de letras.
- `src/lib/render.ts` — dibuja el slide en canvas (medidas en unidades de la
  referencia 2000×563, escaladas a cualquier resolución), ajusta el tamaño de
  fuente para que quepa y equilibra las líneas prefiriendo cortar en
  puntuación. La misma función dibuja la vista previa, el PNG y cada frame del
  video, con los tiempos de animación aprobados (0.55 s entrada, 0.45 s salida).
- `src/lib/video.ts` — codifica H.264 con WebCodecs y empaqueta MP4 con
  `mp4-muxer` (Chrome/Edge; Safari según versión).

## Licencias de los textos

RVR1960 © Sociedades Bíblicas en América Latina; LBLA y NBLA © The Lockman
Foundation. Uso interno de la iglesia. Para distribuir la app públicamente
habría que licenciar los textos o cambiar a Reina-Valera 1909 (dominio público).
