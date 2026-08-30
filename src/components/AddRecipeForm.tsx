import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { RecipeForm, type RecipeFormValues } from './RecipeForm'

interface Props {
  onAdded: () => void
}

export function AddRecipeForm({ onAdded }: Props) {
  const [open, setOpen] = useState(false)

  async function handleSubmit(values: RecipeFormValues) {
    const { error } = await supabase.from('recipes').insert(values)
    if (error) throw error
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button className="add-recipe-toggle" onClick={() => setOpen(true)}>
        + Legg til oppskrift
      </button>
    )
  }

  return (
    <RecipeForm
      heading="Ny oppskrift i din kokebok"
      submitLabel="Lagre oppskrift"
      savingLabel="Lagrer..."
      onSubmit={handleSubmit}
      onCancel={() => setOpen(false)}
    />
  )
}
