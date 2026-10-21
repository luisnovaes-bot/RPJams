import { notFound } from "next/navigation"
import { roomById } from "@/lib/db"
import { PlayerRoom } from "./PlayerRoom"

export default async function Page({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const room = await roomById(roomId)
  if (!room) notFound()
  return <PlayerRoom roomId={room.id} roomName={room.name} />
}
