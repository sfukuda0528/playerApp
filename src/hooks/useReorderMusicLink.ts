import { supabase } from '../lib/supabase'

export function useReorderMusicLink() {
  const reorder = async (linkId: string, newSortOrder: number): Promise<boolean> => {
    const { error } = await supabase
      .from('music_links')
      .update({ sort_order: newSortOrder })
      .eq('id', linkId)
    return !error
  }

  return { reorder }
}
