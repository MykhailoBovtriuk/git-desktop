import { UserIcon } from './icons';

const SIZE = {
  sm: { img: 'w-4 h-4', icon: 12 },
  md: { img: 'w-8 h-8', icon: 20 },
};

export function Avatar({ src, size }: { src: string | null | undefined; size: keyof typeof SIZE }) {
  return src ? (
    <img src={src} alt="" className={`${SIZE[size].img} rounded-full shrink-0`} />
  ) : (
    <UserIcon size={SIZE[size].icon} aria-hidden="true" className="shrink-0 text-subtext" />
  );
}
