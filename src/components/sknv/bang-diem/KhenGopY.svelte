<script>
    import CardIcon from './CardIcon.svelte';
    import { taoKhenGopYChiTiet } from '../../../lib/sknv/cauMauChiTietNV.js';

    // nhomList: field `nhom` trong kết quả tinhDiemNhanVien() —
    // [{ key, ten, tieuChi: [{ten, giaTri, moc, loaiMoc, hasMocTarget, ketQua}], soDat, tongTieuChi }, ...]
    export let nhomList = [];
    // xepChong: true → khen trên, góp ý dưới (thẻ ngoài). Mặc định 2 cột (trang chi tiết).
    export let xepChong = false;

    $: ketQua = taoKhenGopYChiTiet(nhomList);
</script>

<div class="kgy-grid" style:grid-template-columns={xepChong ? '1fr' : null}>
    <div class="kgy-box" style="background:{ketQua.khen.bg};color:{ketQua.khen.color}">
        <CardIcon type="star" size={15} />
        <span>{ketQua.khen.text}</span>
    </div>
    <div class="kgy-box" style="background:{ketQua.gopY.bg};color:{ketQua.gopY.color}">
        <CardIcon type="bulb" size={15} />
        <span>{ketQua.gopY.text}</span>
    </div>
</div>

<style>
    .kgy-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }
    .kgy-box {
        border-radius: 8px;
        padding: 10px 12px;
        display: flex;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.45;
    }
    .kgy-box :global(svg) {
        flex: none;
        margin-top: 2px;
    }
    @media (max-width: 860px) {
        .kgy-grid { grid-template-columns: 1fr; }
    }
</style>
