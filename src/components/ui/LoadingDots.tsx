'use client';

interface LoadingDotsProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'gray' | 'white';
}

export default function LoadingDots({ size = 'md', color = 'primary' }: LoadingDotsProps) {
  const sizeClasses = {
    sm: 'w-1 h-1',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  const colorClasses = {
    primary: 'bg-primary-500',
    gray: 'bg-gray-500',
    white: 'bg-white',
  };

  const dotClass = `${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-bounce`;

  return (
    <div className="flex space-x-1">
      <div className={dotClass} style={{ animationDelay: '0ms' }} />
      <div className={dotClass} style={{ animationDelay: '150ms' }} />
      <div className={dotClass} style={{ animationDelay: '300ms' }} />
    </div>
  );
}