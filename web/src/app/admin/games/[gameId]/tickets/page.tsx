import TicketTypeManager from './TicketTypeManager';

interface Props {
  params: { gameId: string };
}

export default function GameTicketsPage({ params }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <TicketTypeManager gameId={params.gameId} />
    </div>
  );
}
