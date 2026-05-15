export const composition = {
  name: 'recap-v1',
  aspect: '16:9',
};

export function flattenTimeline(timeline) {
  const clips = [];
  for (const day of timeline.days || []) {
    clips.push({
      kind: 'day-card',
      title: day.title,
      date: day.date,
      notes: day.notes || '',
      duration_sec: 2,
    });
    for (const media of day.media || []) {
      clips.push({
        ...media,
        day_number: day.day_number,
        day_title: day.title,
        day_notes: day.notes || '',
      });
    }
  }
  return clips;
}

export function kenBurnsFor(media, index) {
  const direction = index % 2 === 0 ? 'left-to-right' : 'right-to-left';
  return {
    scaleFrom: 1.04,
    scaleTo: 1.14,
    direction,
    duration: media.duration_sec,
  };
}
