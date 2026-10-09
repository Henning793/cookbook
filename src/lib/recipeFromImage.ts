import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { scannedToFormValues, type ScannedFormValues } from './scannedRecipe'

// Samme tak som i edge-funksjonen recipe-from-image.
export const MAX_RECIPE_IMAGES = 6

// Lengste side etter nedskalering. Nok til at liten skrift og håndskrift
// fortsatt kan leses, men en brøkdel av et mobilbilde i størrelse.
const MAX_EDGE_PX = 2000
const JPEG_QUALITY = 0.82

interface EncodedImage {
  media_type: 'image/jpeg'
  data: string
}

async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      // Følger EXIF-rotasjonen, så stående mobilbilder ikke havner på siden.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      // Faller tilbake til <img> under.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Skalerer bildet ned i nettleseren og gjør det om til JPEG før opplasting.
async function encodeImage(file: File): Promise<EncodedImage> {
  let image: Awaited<ReturnType<typeof loadImage>>
  try {
    image = await loadImage(file)
  } catch {
    throw new Error(`Klarte ikke å åpne «${file.name}». Prøv et annet bilde.`)
  }
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Klarte ikke å behandle bildet.')
    // Hvit bakgrunn, så gjennomsiktige PNG-er ikke blir svarte som JPEG.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return { media_type: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) }
  } finally {
    image.close()
  }
}

export async function recipeFromImages(files: File[]): Promise<ScannedFormValues> {
  const images: EncodedImage[] = []
  for (const file of files) images.push(await encodeImage(file))

  const { data, error } = await supabase.functions.invoke('recipe-from-image', { body: { images } })

  if (error) {
    // Edge-funksjonen svarer med en lesbar feilmelding på norsk.
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null)
      if (typeof body?.error === 'string') throw new Error(body.error)
      throw new Error('Klarte ikke å lese oppskriften. Prøv igjen om litt.')
    }
    throw new Error('Klarte ikke å koble til. Sjekk nettforbindelsen og prøv igjen.')
  }

  return scannedToFormValues((data as { recipe?: unknown } | null)?.recipe)
}
