import NewGameForm from './NewGameForm';

export default function NewGamePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-offblack">Add New Game</h1>
        <p className="text-sm text-offblack/50 mt-1">Fill in the details to create a new basketball game.</p>
      </div>
      <NewGameForm />
    </div>
  );
}
