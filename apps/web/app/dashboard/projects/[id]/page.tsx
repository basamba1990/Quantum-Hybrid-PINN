import ProjectDetailClient from './ProjectDetailClient'

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
  
  return <ProjectDetailClient id={id} />
}
