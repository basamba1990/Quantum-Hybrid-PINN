// KELLY SENECAL TRULY-INDUSTRIAL DYNAMIC ROUTING V2.1.7
export const dynamic = 'force-dynamic'
export const revalidate = 0

import ProjectDetailClient from './ProjectDetailClient'
import { createClient } from '@/lib/supabase/server'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
  const id = resolvedParams?.id

  if (!id) {
    return <div className="p-8 text-white">Error: Project ID missing in route params</div>
  }

  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return <ProjectDetailClient id={id} project={project ?? null} />
}
