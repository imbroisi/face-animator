export type Locale = 'en' | 'pt-BR';

export type FaceLabelKey = 'normal' | 'upset' | 'sad' | 'suspicious';

export type Catalog = {
  loadAudio: string;
  loadAudioFile: string;
  noAudioLoaded: string;
  analyzingSpeech: string;
  saveMov: string;
  processingPercent: (percent: number) => string;
  audioArea: string;
  language: string;
  languageEn: string;
  languagePtBr: string;
  languageEnglish: string;
  languagePortuguese: string;
  nextImage: string;
  imageName: string;
  faceSet: string;
  faceLocked: string;
  faces: Record<FaceLabelKey, string>;
  faceOptions: string;
  faceClosed: (name: string) => string;
  previewSize: string;
  sizeLarge: string;
  sizeSmall: string;
  ball: string;
  mouth: string;
  waveform: string;
  currentTime: string;
  totalTime: string;
  stepBack: string;
  playAudio: string;
  pauseAudio: string;
  stepForward: string;
  stopAudio: string;
  removeAudio: string;
  playhead: string;
  playheadValue: (position: number, total: number) => string;
  processing: string;
  cancel: string;
  videoSize: string;
  size4k: string;
  size1080p: string;
  sizeNative: string;
  errorLoadAudio: string;
  errorPlayAudio: string;
  errorEmptyVideo: string;
  errorExport: string;
  errorInvalidSampleRate: string;
  errorInvalidTriggers: string;
  errorInvalidTimes: string;
  errorInvalidCycle: string;
  errorMouthCloseRequired: string;
  errorNoImages: string;
  errorPrepareImages: string;
  errorMissingFrame: string;
  errorExportRestart: string;
  errorFaceTooTall: string;
  errorExportBusy: string;
  errorExportTooLarge: string;
  errorExportMissingFiles: string;
  errorExportInvalidVideo: string;
  errorExportInvalidSequence: string;
  errorExportInvalidDuration: string;
  errorExportMustStartClosed: string;
  errorExportMustEndClosed: string;
  errorExportInvalidImage: string;
  errorExportImageSize: string;
  errorExportFfmpeg: string;
};

export const en: Catalog = {
  loadAudio: 'Load audio',
  loadAudioFile: 'Load audio file',
  noAudioLoaded: 'No audio loaded',
  analyzingSpeech: 'Analyzing speech…',
  saveMov: 'Save MOV',
  processingPercent: (percent) => `Processing… ${percent}%`,
  audioArea: 'Audio area',
  language: 'Language',
  languageEn: 'EN',
  languagePtBr: 'PT',
  languageEnglish: 'English',
  languagePortuguese: 'Portuguese (Brazil)',
  nextImage: 'Next image',
  imageName: 'Image name',
  faceSet: 'Face set',
  faceLocked: 'Only works with no audio loaded',
  faces: {
    normal: 'Normal',
    upset: 'Upset',
    sad: 'Sad',
    suspicious: 'Suspicious',
  },
  faceOptions: 'Face options',
  faceClosed: (name) => `${name} face, mouth closed`,
  previewSize: 'size',
  sizeLarge: 'large',
  sizeSmall: 'small',
  ball: 'Ball',
  mouth: 'Mouth',
  waveform: 'Mono waveform of the loaded audio',
  currentTime: 'Current time',
  totalTime: 'Total time',
  stepBack: 'Back 1 frame',
  playAudio: 'Play audio',
  pauseAudio: 'Pause audio',
  stepForward: 'Forward 1 frame',
  stopAudio: 'Stop and return to the start',
  removeAudio: 'Remove audio',
  playhead: 'Playback position',
  playheadValue: (position, total) => `${position.toFixed(1)} of ${total.toFixed(1)} seconds`,
  processing: 'Processing…',
  cancel: 'Cancel',
  videoSize: 'Video size',
  size4k: '4K (height 2160)',
  size1080p: '1080p (height 1080)',
  sizeNative: 'Native (face resolution)',
  errorLoadAudio: 'Could not load this audio.',
  errorPlayAudio: 'Could not play the audio. Try again.',
  errorEmptyVideo: 'The generated video is empty.',
  errorExport: 'Failed to export the video.',
  errorInvalidSampleRate: 'Invalid audio sample rate.',
  errorInvalidTriggers: 'Triggers must be between 0 and 100.',
  errorInvalidTimes: 'Times must be non-negative.',
  errorInvalidCycle: 'Cycle duration must be greater than zero.',
  errorMouthCloseRequired: 'mouth-close.png is required.',
  errorNoImages: 'No images available to export.',
  errorPrepareImages: 'Could not prepare the images.',
  errorMissingFrame: 'Animation image not found.',
  errorExportRestart: 'Could not export. Restart the server with npm run dev.',
  errorFaceTooTall: 'The face is taller than the chosen frame.',
  errorExportBusy: 'An export is already in progress.',
  errorExportTooLarge: 'Export limit: 200 MB per file.',
  errorExportMissingFiles: 'Audio file or animation is missing.',
  errorExportInvalidVideo: 'Invalid video settings.',
  errorExportInvalidSequence: 'Invalid animation sequence.',
  errorExportInvalidDuration: 'Invalid animation duration.',
  errorExportMustStartClosed: 'The animation must start with mouth-close and eye-open.',
  errorExportMustEndClosed: 'The animation must end with 2 seconds of mouth-close.',
  errorExportInvalidImage: 'Invalid image.',
  errorExportImageSize: 'Image dimensions do not match the video.',
  errorExportFfmpeg: 'Failed to generate the MOV.',
};

export const ptBR: Catalog = {
  loadAudio: 'Carregar áudio',
  loadAudioFile: 'Carregar arquivo de áudio',
  noAudioLoaded: 'Nenhum áudio carregado',
  analyzingSpeech: 'Analisando a fala…',
  saveMov: 'Salvar MOV',
  processingPercent: (percent) => `Processando… ${percent}%`,
  audioArea: 'Área de áudio',
  language: 'Idioma',
  languageEn: 'EN',
  languagePtBr: 'PT',
  languageEnglish: 'Inglês',
  languagePortuguese: 'Português (Brasil)',
  nextImage: 'Próxima imagem',
  imageName: 'Nome da imagem',
  faceSet: 'Conjunto de faces',
  faceLocked: 'Só funciona sem áudio carregado',
  faces: {
    normal: 'Normal',
    upset: 'Irritado',
    sad: 'Triste',
    suspicious: 'Desconfiado',
  },
  faceOptions: 'Opções de face',
  faceClosed: (name) => `Face ${name}, boca fechada`,
  previewSize: 'tamanho',
  sizeLarge: 'grande',
  sizeSmall: 'pequeno',
  ball: 'Bola',
  mouth: 'Boca',
  waveform: 'Forma de onda mono do áudio carregado',
  currentTime: 'Tempo atual',
  totalTime: 'Tempo total',
  stepBack: 'Recuar 1 quadro',
  playAudio: 'Reproduzir áudio',
  pauseAudio: 'Pausar áudio',
  stepForward: 'Avançar 1 quadro',
  stopAudio: 'Parar e voltar ao início',
  removeAudio: 'Remover áudio',
  playhead: 'Posição da reprodução',
  playheadValue: (position, total) => `${position.toFixed(1)} de ${total.toFixed(1)} segundos`,
  processing: 'Processando…',
  cancel: 'Cancelar',
  videoSize: 'Tamanho do vídeo',
  size4k: '4K (altura 2160)',
  size1080p: '1080p (altura 1080)',
  sizeNative: 'Nativo (resolução da face)',
  errorLoadAudio: 'Não foi possível carregar este áudio.',
  errorPlayAudio: 'Não foi possível reproduzir o áudio. Tente novamente.',
  errorEmptyVideo: 'O vídeo gerado está vazio.',
  errorExport: 'Falha ao exportar o vídeo.',
  errorInvalidSampleRate: 'Taxa de áudio inválida.',
  errorInvalidTriggers: 'Os triggers devem estar entre 0 e 100.',
  errorInvalidTimes: 'Os tempos devem ser não negativos.',
  errorInvalidCycle: 'A duração do ciclo deve ser maior que zero.',
  errorMouthCloseRequired: 'A imagem mouth-close.png é necessária.',
  errorNoImages: 'Nenhuma imagem disponível para exportar.',
  errorPrepareImages: 'Não foi possível preparar as imagens.',
  errorMissingFrame: 'Imagem da animação não encontrada.',
  errorExportRestart: 'Não foi possível exportar. Reinicie o servidor com npm run dev.',
  errorFaceTooTall: 'A face é maior que o quadro escolhido.',
  errorExportBusy: 'Já existe uma exportação em andamento.',
  errorExportTooLarge: 'Limite de exportação: 200 MB por arquivo.',
  errorExportMissingFiles: 'Arquivo de áudio ou animação ausente.',
  errorExportInvalidVideo: 'Configuração de vídeo inválida.',
  errorExportInvalidSequence: 'Sequência de animação inválida.',
  errorExportInvalidDuration: 'Duração da animação inválida.',
  errorExportMustStartClosed: 'A animação deve começar com mouth-close e eye-open.',
  errorExportMustEndClosed: 'A animação deve terminar com 2 segundos de mouth-close.',
  errorExportInvalidImage: 'Imagem inválida.',
  errorExportImageSize: 'Dimensões da imagem não correspondem ao vídeo.',
  errorExportFfmpeg: 'Falha ao gerar o MOV.',
};

export const catalogs: Record<Locale, Catalog> = {
  en,
  'pt-BR': ptBR,
};

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'pt-BR';
}

export type StringKey = {
  [K in keyof Catalog]: Catalog[K] extends string ? K : never;
}[keyof Catalog];

export function catalogText(catalog: Catalog, key: string): string | undefined {
  const value = catalog[key as StringKey];
  return typeof value === 'string' ? value : undefined;
}
