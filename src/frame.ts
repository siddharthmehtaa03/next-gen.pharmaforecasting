export const FRAME_ID = 'frame-scroll'
export const scrollFrameTop = (smooth = false) => (document.getElementById(FRAME_ID) ?? window).scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
