<script>
  // Huy chương top 5. Hạng ngoài 1-5 → không vẽ gì.
  export let hang;

  const MAU = {
    1: { xu: '#EF9F27', vien: '#BA7517', dai1: '#E24B4A', dai2: '#378ADD', so: '#412402' },
    2: { xu: '#D3D1C7', vien: '#888780', dai1: '#378ADD', dai2: '#85B7EB', so: '#2C2C2A' },
    3: { xu: '#F0997B', vien: '#993C1D', dai1: '#1D9E75', dai2: '#5DCAA5', so: '#4A1B0C' },
    4: { xu: '#B5D4F4', vien: '#185FA5', dai1: '#7F77DD', dai2: '#AFA9EC', so: '#042C53' },
    5: { xu: '#B5D4F4', vien: '#185FA5', dai1: '#7F77DD', dai2: '#AFA9EC', so: '#042C53' }
  };

  const NGOI_SAO = '26,24 28.94,31.96 37.41,32.29 30.76,37.55 33.05,45.71 26,41 18.95,45.71 21.24,37.55 14.59,32.29 23.06,31.96';

  $: mau = MAU[hang];
  $: to = hang >= 1 && hang <= 3;
  $: rong = to ? 52 : 44;
  $: cao = to ? 58 : 49;
</script>

{#if mau}
  <svg class="huy-chuong" width={rong} height={cao} viewBox="0 0 52 58" aria-label="Hạng {hang}">
    <polygon points="10,0 22,0 30,24 18,24" fill={mau.dai1} />
    <polygon points="30,0 42,0 34,24 22,24" fill={mau.dai2} />
    <circle cx="26" cy="36" r="19.5" fill={mau.xu} stroke={mau.vien} stroke-width="3" />
    <circle cx="26" cy="36" r="15" fill="none" stroke={mau.vien} stroke-width="1" stroke-dasharray="2 2" />
    {#if to}
      <polygon points={NGOI_SAO} fill={mau.vien} fill-opacity="0.35" />
    {/if}
    <text x="26" y="36" dy="0.35em" text-anchor="middle" font-size="16" font-weight="800" fill={mau.so}>{hang}</text>
  </svg>
{/if}

<style>
  .huy-chuong {
    display: block;
    flex: none;
  }
</style>
