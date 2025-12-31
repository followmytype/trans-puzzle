import { createGame } from './game'

window.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app') as HTMLDivElement
  createGame(root)
})
