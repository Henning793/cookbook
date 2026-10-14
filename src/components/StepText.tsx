import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { stepDisplayParts } from '../lib/recipeIngredients'
import type { RecipeIngredients } from '../types'

// Viser en stegtekst uten @-koblingene til komponenter, som bare styrer
// "Du trenger nå" i kokemodus. @-koblinger til teknikker blir lenker til
// teknikken, og tilbake-knappen der viser linkedFrom.
export function StepText({
  text,
  ingredients,
  recipeId,
  linkedFrom,
}: {
  text: string
  ingredients: RecipeIngredients
  recipeId: string
  linkedFrom: string
}) {
  const { techniques } = useApp()
  const linkable = techniques.filter((technique) => technique.id !== recipeId)
  return (
    <>
      {stepDisplayParts(text, ingredients, linkable).map((part, i) =>
        part.techniqueId ? (
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
