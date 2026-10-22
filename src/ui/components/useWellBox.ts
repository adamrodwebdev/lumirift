import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where the well's canvas sits inside a layer laid over the game screen
 * (the danger's cracks, the surge's waves), kept up to date as either moves.
 */
export function useWellBox(well: () => HTMLElement | null, layer: Ref<HTMLElement | null>) {
  const box = ref<Box | null>(null);

  const measure = () => {
    const canvas = well();
    const own = layer.value;
    if (!canvas || !own) {
      box.value = null;
      return;
    }
    const a = canvas.getBoundingClientRect();
    const b = own.getBoundingClientRect();
    box.value =
      a.width < 1 || a.height < 1
        ? null
        : { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
  };

  const observer = new ResizeObserver(measure);
  watch(well, (canvas, old) => {
    if (old) observer.unobserve(old);
    if (canvas) observer.observe(canvas);
    measure();
  });
  onMounted(() => {
    if (layer.value) observer.observe(layer.value);
    const canvas = well();
    if (canvas) observer.observe(canvas);
    measure();
  });
  onBeforeUnmount(() => observer.disconnect());

  const boxStyle = computed(() => {
    const at = box.value;
    return at
      ? {
          left: `${at.left}px`,
          top: `${at.top}px`,
          width: `${at.width}px`,
          height: `${at.height}px`,
        }
      : {};
  });

  return { box, boxStyle };
}
