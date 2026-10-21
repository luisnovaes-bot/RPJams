import { notFound } from "next/navigation"
import { roomByMasterToken } from "@/lib/db"
import { MasterRoom } from "./MasterRoom"

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const room = await roomByMasterToken(token)
  if (!room) notFound()
  return <MasterRoom token={token} roomId={room.id} roomName={room.name} />
}
