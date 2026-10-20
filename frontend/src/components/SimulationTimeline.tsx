import type { MouseEvent } from 'react';
import type { SimulationEvent } from '../types/simulation';
import { getUrgency } from '../lib/urgency';
import './SimulationTimeline.css';

interface SimulationTimelineProps {
  events: SimulationEvent[];
  duration: number;
  activeEventId: string | null;
  onSelectEvent: (id: string) => void;
  onAddAtMinute: (minute: number) => void;
}

function minuteAtPosition(clientX: number, left: number, width: number, duration: number): number | null {
  if (width === 0) return null;
  const position = Math.min(1, Math.max(0, (clientX - left) / width));
  return Math.min(duration, Math.max(1, Math.round((1 - position) * duration)));
}

export default function SimulationTimeline({
  events,
  duration,
  activeEventId,
  onSelectEvent,
  onAddAtMinute,
}: SimulationTimelineProps) {
  const handleTrackClick = (event: MouseEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const minute = minuteAtPosition(event.clientX, left, width, duration);
    if (minute !== null) onAddAtMinute(minute);
  };

  return (
    <section className="event-timeline" aria-labelledby="event-timeline-title">
      <h4 className="event-timeline-title" id="event-timeline-title">ציר זמן של אירועי הסימולציה</h4>
      {events.length === 0 && (
        <p className="event-timeline-empty">לחצו על מקום פנוי בציר כדי להוסיף אירוע בדקה הזו.</p>
      )}
      <div className="event-timeline-scale">
        <div className="event-timeline-track" onClick={handleTrackClick}>
          <div className="event-timeline-axis" aria-hidden="true" />
          <ol className="event-timeline-list" aria-label="אירועים לפי זמן בסימולציה">
            {[...events]
              .sort((left, right) => left.minute - right.minute)
              .map((timelineEvent) => (
                <li
                  className="event-timeline-item"
                  key={timelineEvent.id}
                  style={{ right: `${(timelineEvent.minute / duration) * 100}%` }}
                >
                  <button
                    type="button"
                    className={`event-timeline-point urgency-${getUrgency(timelineEvent.threatLevel).level}${activeEventId === timelineEvent.id ? ' is-active' : ''}`}
                    aria-label={`מעבר לאירוע ${timelineEvent.title}, דקה ${timelineEvent.minute}`}
                    aria-pressed={activeEventId === timelineEvent.id}
                    title={`${timelineEvent.title} · דקה ${timelineEvent.minute}`}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onSelectEvent(timelineEvent.id);
                    }}
                  >
                    <span className="event-timeline-marker" aria-hidden="true" />
                  </button>
                </li>
              ))}
          </ol>
          <div className="event-timeline-ticks" aria-hidden="true">
            {[...new Set(events.map((timelineEvent) => timelineEvent.minute))]
              .sort((left, right) => left - right)
              .map((minute) => (
                <span
                  className="event-timeline-tick"
                  key={minute}
                  style={{ right: `${(minute / duration) * 100}%` }}
                >
                  {minute}
                </span>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
