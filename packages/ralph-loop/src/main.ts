import { renderRalph } from './generated/ralph-render.ts';
import './style.css';

const root = document.getElementById('root')!;

if (root) {
    root.appendChild(renderRalph());
}
