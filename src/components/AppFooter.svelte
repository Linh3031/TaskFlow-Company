<script>
    // Chân trang nằm cuối vùng cuộn của từng tab (cuộn hết mới thấy)
    import { activeStoreId } from '../lib/stores.js';
</script>

<footer>Design by 3031 | Kho đang xem: {$activeStoreId}</footer>

<style>
    footer { flex-shrink: 0; text-align: center; padding: 10px 10px calc(10px + env(safe-area-inset-bottom)); color: #999; font-size: 0.75rem; font-weight: 700; }
</style>
