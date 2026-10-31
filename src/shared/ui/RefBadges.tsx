import { Badge } from './Badge';
import { TruncatedText } from './TruncatedText';

export function RefBadges({ refs, maxWidth }: { refs: string[]; maxWidth: string }) {
  return refs.slice(0, 3).map(ref => (
    <Badge key={ref} variant="ref">
      <TruncatedText className={`block ${maxWidth}`}>{ref.replace('HEAD -> ', '')}</TruncatedText>
    </Badge>
  ));
}
