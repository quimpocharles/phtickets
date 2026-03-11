import { redirect } from 'next/navigation';
import { getGames } from '@/lib/api';

export default async function Home() {
  try {
    const games = await getGames();
    if (games.length > 0) {
      redirect(`/passes/${games[0]._id}`);
    }
  } catch {
    // fall through if API is unreachable
  }
  redirect('/passes');
}
