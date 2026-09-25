export type Locale = 'en' | 'pt-BR';

export type FaceLabelKey = 'normal' | 'upset' | 'sad' | 'suspicious';

export type Catalog = {
  loadAudio: string;
  loadAudioFile: string;
  loadAudioSource: string;
  loadAudioLocal: string;
  loadAudioWeb: string;
  loadAudioUrl: string;
  loadAudioUrlHint: string;
  chooseAudioFile: string;
  noAudioLoaded: string;
  analyzingSpeech: string;
  downloadingAudio: string;
  example: string;
  welcomeHint: string;
  exampleLoadHint: string;
  exampleUrlHint: string;
  examplePlayHint: string;
  exampleMoodHint: string;
  exampleDropHint: string;
  exampleReplayHint: string;
  exampleSaveHint: string;
  saveMov: string;
  processingPercent: (percent: number) => string;
  videoBlur: string;
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
  errorInvalidAudioUrl: string;
  errorLoadAudioUrl: string;
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
  loadAudio: 'Load speech',
  loadAudioFile: 'Load speech file',
  loadAudioSource: 'Speech source',
  loadAudioLocal: 'This computer',
  loadAudioWeb: 'From the web',
  loadAudioUrl: 'Speech URL',
  loadAudioUrlHint: 'Paste a direct link to a speech file.',
  chooseAudioFile: 'Choose file',
  noAudioLoaded: 'No speech loaded',
  analyzingSpeech: 'Analyzing speech…',
  downloadingAudio: 'Downloading speech…',
  example: 'Example',
  welcomeHint: 'Welcome to Face Animator!\nYou can click EXAMPLE at any time and follow, step by step, how the app works.',
  exampleLoadHint: 'Click to load a line of speech.',
  exampleUrlHint: 'Choose a local file or one from the web. This example uses a file from the web.\nClick LOAD SPEECH.',
  examplePlayHint: 'The file is loaded.\nClick play, and wait until the end.',
  exampleMoodHint: 'You can optionally change the mood during the speech. Start dragging this face onto the speech area.',
  exampleDropHint: 'Drop the upset face here.',
  exampleReplayHint: 'Now click play to see the speech with the upset face included.',
  exampleSaveHint: 'Now it is time to save the animation, to use it in your video.',
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
  videoBlur: 'Face blur (px)',
  size4k: '4K (height 2160)',
  size1080p: '1080p (height 1080)',
  sizeNative: 'Native (face resolution)',
  errorLoadAudio: 'Could not load this audio.',
  errorInvalidAudioUrl: 'Enter a valid http or https URL.',
  errorLoadAudioUrl: 'Could not download this audio. Check the link or try a local file.',
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
  loadAudio: 'Carregar fala',
  loadAudioFile: 'Carregar arquivo de fala',
  loadAudioSource: 'Origem da fala',
  loadAudioLocal: 'Arquivo local',
  loadAudioWeb: 'Arquivo na web',
  loadAudioUrl: 'URL da fala',
  loadAudioUrlHint: 'Cole o link direto do arquivo de fala.',
  chooseAudioFile: 'Escolher arquivo',
  noAudioLoaded: 'Nenhuma fala carregada',
  analyzingSpeech: 'Analisando a fala…',
  downloadingAudio: 'Baixando a fala…',
  example: 'Exemplo',
  welcomeHint: 'Bem-vindo ao Face Animator!\nA qualquer momento você pode clicar em EXEMPLO e assistir, passo a passo, o funcionamento do aplicativo.',
  exampleLoadHint: 'Clique para carregar uma fala.',
  exampleUrlHint: 'Escolha entre um arquivo local ou na web. Para este exemplo estamos usando um arquivo na web.\nClique em CARREGAR FALA.',
  examplePlayHint: 'O arquivo foi carregado.\nClique em play, e espere até o final.',
  exampleMoodHint: 'Você pode opcionalmente mudar o humor durante a fala. Comece a arrastar este rosto até a área da fala.',
  exampleDropHint: 'Solte o aborrecido aqui.',
  exampleReplayHint: 'Agora clique em play para ver a fala com o aborrecido incluido.',
  exampleSaveHint: 'Agora está na hora de salvar a animação, para ser usada em seu vídeo.',
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
  videoBlur: 'Blur da face (px)',
  size4k: '4K (altura 2160)',
  size1080p: '1080p (altura 1080)',
  sizeNative: 'Nativo (resolução da face)',
  errorLoadAudio: 'Não foi possível carregar este áudio.',
  errorInvalidAudioUrl: 'Informe uma URL http ou https válida.',
  errorLoadAudioUrl: 'Não foi possível baixar este áudio. Verifique o link ou use um arquivo local.',
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
