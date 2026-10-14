import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { stepDisplayParts } from '../lib/recipeIngredients'
import type { RecipeIngredients } from '../types'

// Viser en stegtekst uten @-koblingene til komponenter, som bare styrer
// "Du trenger nå" i kokemodus. @-koblinger til teknikker blir lenker til
// teknikken, og tilbake-knappen der viser linkedFrom. I kokemodus sendes
// onTechnique med, og lenken åpner teknikken i et panel i stedet.
export function StepText({
  text,
  ingredients,
  recipeId,
  linkedFrom,
  onTechnique,
}: {
  text: string
  ingredients: RecipeIngredients
  recipeId: string
  linkedFrom: string
  onTechnique?: (techniqueId: string) => void
}) {
  const { techniques } = useApp()
  const linkable = techniques.filter((technique) => technique.id !== recipeId)
  return (
    <>
      {stepDisplayParts(text, ingredients, linkable).map((part, i) =>
        part.techniqueId && onTechnique ? (
          <button
            key={i}
            type="button"
            className="step-technique-link step-technique-button"
            onClick={() => onTechnique(part.techniqueId!)}
          >
            {part.text}
          </button>
        ) : part.techniqueId ? (
          <Link key={i} className="step-technique-link" to={`/oppskrift/${part.techniqueId}`} state={{ linkedFrom }}>
            {part.text}
          </Link>
        ) : (
          part.text
        )
      )}
    </>
  )
}
