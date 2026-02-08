export type Locale = "en" | "es" | "ca";

export const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "ca", label: "Català" },
];

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Intro
    "intro.start": "Start",
    "intro.imageCount": "You'll see {count} image{plural}",
    "intro.guidedTourCount": "You'll evaluate {count} image{plural}, then compare {pairs} pairs",
    "intro.sessionNotFound": "Session not found.",
    "intro.loadError": "Failed to load session.",

    // Evaluate
    "eval.phaseLabel": "Phase 1 of 2 — Rate",
    "eval.nOfM": "{n} of {total}",
    "eval.seeVideo": "See video",
    "eval.recording": "Recording...",
    "eval.audioRecorded": "Audio recorded",
    "eval.next": "Next",
    "eval.nextPhase": "Next Phase",
    "eval.finish": "Finish",
    "eval.submitting": "Submitting...",
    "eval.submitError": "Failed to submit your response. Please try again.",
    "eval.noImages": "No images to evaluate.",
    "eval.scaleLow": "Blah!",
    "eval.scaleHigh": "Great!",
    "eval.preferThis": "Prefer This",
    "eval.oops": "Oops",

    // Compare
    "compare.phaseLabel": "Phase 2 of 2 — Compare",
    "compare.pairNofM": "Pair {n} of {total}",
    "compare.vs": "VS",
    "compare.tapInstruction": "Tap the image you prefer",
    "compare.noPairs": "No pairs to compare.",

    // Done
    "done.finalThoughts": "Want to share any final thoughts?",
    "done.submitRecording": "Submit Recording",
    "done.submitting": "Submitting...",
    "done.confirmation": "Your recording has been submitted. Thank you!",
    "done.closeTab": "You may close this tab.",
    "done.submitError": "Failed to submit your recording. Please try again.",
  },
  es: {
    "intro.start": "Comenzar",
    "intro.imageCount": "Verás {count} imagen{plural}",
    "intro.guidedTourCount": "Evaluarás {count} imagen{plural} y luego compararás {pairs} pares",
    "intro.sessionNotFound": "Sesión no encontrada.",
    "intro.loadError": "Error al cargar la sesión.",

    "eval.phaseLabel": "Fase 1 de 2 — Valorar",
    "eval.nOfM": "{n} de {total}",
    "eval.seeVideo": "Ver vídeo",
    "eval.recording": "Grabando...",
    "eval.audioRecorded": "Audio grabado",
    "eval.next": "Siguiente",
    "eval.nextPhase": "Siguiente fase",
    "eval.finish": "Terminar",
    "eval.submitting": "Enviando...",
    "eval.submitError": "No se pudo enviar tu respuesta. Inténtalo de nuevo.",
    "eval.noImages": "No hay imágenes para evaluar.",
    "eval.scaleLow": "¡Mal!",
    "eval.scaleHigh": "¡Genial!",
    "eval.preferThis": "Prefiero esta",
    "eval.oops": "Ups",

    "compare.phaseLabel": "Fase 2 de 2 — Comparar",
    "compare.pairNofM": "Par {n} de {total}",
    "compare.vs": "VS",
    "compare.tapInstruction": "Toca la imagen que prefieras",
    "compare.noPairs": "No hay pares para comparar.",

    "done.finalThoughts": "¿Quieres compartir alguna impresión final?",
    "done.submitRecording": "Enviar grabación",
    "done.submitting": "Enviando...",
    "done.confirmation": "Tu grabación se ha enviado. ¡Gracias!",
    "done.closeTab": "Puedes cerrar esta pestaña.",
    "done.submitError": "No se pudo enviar tu grabación. Inténtalo de nuevo.",
  },
  ca: {
    "intro.start": "Començar",
    "intro.imageCount": "Veuràs {count} imatge{plural}",
    "intro.guidedTourCount": "Avaluaràs {count} imatge{plural} i després compararàs {pairs} parells",
    "intro.sessionNotFound": "Sessió no trobada.",
    "intro.loadError": "Error en carregar la sessió.",

    "eval.phaseLabel": "Fase 1 de 2 — Valorar",
    "eval.nOfM": "{n} de {total}",
    "eval.seeVideo": "Veure vídeo",
    "eval.recording": "Gravant...",
    "eval.audioRecorded": "Àudio gravat",
    "eval.next": "Següent",
    "eval.nextPhase": "Següent fase",
    "eval.finish": "Acabar",
    "eval.submitting": "Enviant...",
    "eval.submitError": "No s'ha pogut enviar la teva resposta. Torna-ho a provar.",
    "eval.noImages": "No hi ha imatges per avaluar.",
    "eval.scaleLow": "Dolent!",
    "eval.scaleHigh": "Genial!",
    "eval.preferThis": "Prefereixo aquesta",
    "eval.oops": "Ups",

    "compare.phaseLabel": "Fase 2 de 2 — Comparar",
    "compare.pairNofM": "Parell {n} de {total}",
    "compare.vs": "VS",
    "compare.tapInstruction": "Toca la imatge que prefereixis",
    "compare.noPairs": "No hi ha parells per comparar.",

    "done.finalThoughts": "Vols compartir alguna impressió final?",
    "done.submitRecording": "Enviar gravació",
    "done.submitting": "Enviant...",
    "done.confirmation": "La teva gravació s'ha enviat. Gràcies!",
    "done.closeTab": "Pots tancar aquesta pestanya.",
    "done.submitError": "No s'ha pogut enviar la teva gravació. Torna-ho a provar.",
  },
};

export function t(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const str = translations[locale]?.[key] ?? translations.en[key] ?? key;
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}
