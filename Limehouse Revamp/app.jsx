// Main app — Design canvas with 3 variations + Tweaks panel
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "viewport": "desktop",
  "yoyMode": true,
  "sourcePills": true,
  "density": "comfortable"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setEditMode(true);
      if (e.data.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Phone frame dimensions
  const phoneW = 390, phoneH = 844;
  const deskW = 1280, deskH = 980;
  const w = tweaks.viewport === 'phone' ? phoneW : deskW;
  const h = tweaks.viewport === 'phone' ? phoneH : deskH;

  const variations = [
    { id: 'a', label: 'A · Tightened classic', sub: 'Same vocabulary as today, denser, sparkline + YoY on every card.', Comp: window.VarA },
    { id: 'b', label: 'B · Compact rows', sub: 'Mobile-first list rows. Hero strip on top, grouped tables below.', Comp: window.VarB },
    { id: 'c', label: 'C · Editorial', sub: 'Bigger headline metrics, finance-app rhythm, more chart real estate.', Comp: window.VarC },
  ];

  return (
    <>
      <DesignCanvas title="Limehouse Dashboard — One-page redesign" subtitle="Three directions · click any artboard to focus">
        <DCSection id="dashboards" title="One-page dashboard concepts">
          {variations.map(v => (
            <DCArtboard key={v.id} id={v.id} label={v.label} sublabel={v.sub} width={w} height={h}>
              <ArtboardWrapper viewport={tweaks.viewport} mobile={tweaks.viewport === 'phone'} w={w} h={h}>
                <v.Comp tweaks={tweaks} />
              </ArtboardWrapper>
            </DCArtboard>
          ))}
        </DCSection>
      </DesignCanvas>

      {editMode && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Layout">
            <TweakRadio label="Viewport"
              value={tweaks.viewport}
              options={[{ value: 'desktop', label: 'Desktop' }, { value: 'phone', label: 'Phone' }]}
              onChange={(v) => setTweak('viewport', v)} />
          </TweakSection>
          <TweakSection title="Display">
            <TweakToggle label="YoY comparisons" value={tweaks.yoyMode} onChange={(v) => setTweak('yoyMode', v)} />
            <TweakToggle label="Source pills (RE/BD)" value={tweaks.sourcePills} onChange={(v) => setTweak('sourcePills', v)} />
          </TweakSection>
        </TweaksPanel>
      )}
    </>
  );
}

// Wraps a variation in a sized "screen" (phone or desktop) with appropriate scaling
function ArtboardWrapper({ viewport, mobile, w, h, children }) {
  return (
    <div style={{
      width: w, height: h, overflow: 'auto',
      background: '#f4f5f3', position: 'relative',
      borderRadius: mobile ? 16 : 0,
    }}>
      {children}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
