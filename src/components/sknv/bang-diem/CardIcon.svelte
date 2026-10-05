<script>
  export let type = 'trophy'; // 'trophy' | 'medal' | 'star' | 'bulb'
  export let size = 14;

  $: strokeWidth = type === 'star' || type === 'bulb' ? 2.4 : 2.2;
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round">
  {#if type === 'trophy'}
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
  {:else if type === 'medal'}
    <path d="M8 3l4 6 4-6" />
    <circle cx="12" cy="15" r="6" />
  {:else if type === 'star'}
    <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z" />
  {:else if type === 'bulb'}
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  {/if}
</svg>
