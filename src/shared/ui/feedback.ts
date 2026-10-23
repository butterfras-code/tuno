import { el } from './components.ts';
import './feedback.css';

export function createFeedbackLink() {
  const link = el('a', 'feedback-link', 'Feedback/Suggestions?');
  link.href = 'mailto:feedback@tuno.cc';
  return link;
}
