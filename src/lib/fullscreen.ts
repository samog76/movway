type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenCapableVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

const asPromise = async (value: Promise<void> | void) => {
  await Promise.resolve(value);
};

export const getFullscreenElement = (doc: Document = document): Element | null => {
  const fullDoc = doc as FullscreenCapableDocument;
  return (
    fullDoc.fullscreenElement ??
    fullDoc.webkitFullscreenElement ??
    fullDoc.mozFullScreenElement ??
    fullDoc.msFullscreenElement ??
    null
  );
};

export const requestElementFullscreen = async (element: HTMLElement | null): Promise<boolean> => {
  if (!element) return false;
  const fullElement = element as FullscreenCapableElement;
  const videoElement = element as FullscreenCapableVideo;
  try {
    if (fullElement.requestFullscreen) {
      await fullElement.requestFullscreen();
      return true;
    }
    if (fullElement.webkitRequestFullscreen) {
      await asPromise(fullElement.webkitRequestFullscreen());
      return true;
    }
    if (fullElement.mozRequestFullScreen) {
      await asPromise(fullElement.mozRequestFullScreen());
      return true;
    }
    if (fullElement.msRequestFullscreen) {
      await asPromise(fullElement.msRequestFullscreen());
      return true;
    }
    if (videoElement.webkitEnterFullscreen) {
      videoElement.webkitEnterFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
};

export const exitDocumentFullscreen = async (doc: Document = document): Promise<boolean> => {
  const fullDoc = doc as FullscreenCapableDocument;
  try {
    if (fullDoc.exitFullscreen) {
      await fullDoc.exitFullscreen();
      return true;
    }
    if (fullDoc.webkitExitFullscreen) {
      await asPromise(fullDoc.webkitExitFullscreen());
      return true;
    }
    if (fullDoc.mozCancelFullScreen) {
      await asPromise(fullDoc.mozCancelFullScreen());
      return true;
    }
    if (fullDoc.msExitFullscreen) {
      await asPromise(fullDoc.msExitFullscreen());
      return true;
    }
  } catch {
    return false;
  }
  return false;
};
