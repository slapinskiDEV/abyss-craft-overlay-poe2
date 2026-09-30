import { createContext, useContext } from 'react';
import type { GameLocalizationProvider } from '../../i18n/game/providers/types';

export const GameTermsContext = createContext<GameLocalizationProvider | null>(null);

export function useGameTerms(): GameLocalizationProvider {
  const game = useContext(GameTermsContext);
  if (!game) throw new Error('GameTermsContext missing');
  return game;
}
