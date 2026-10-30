import { Icon } from "@/components/icons";
import type { Walkthrough as WalkthroughData } from "@/lib/visual-types";

/*
  O passo a passo do método, seguindo um exemplo só. Em cima, o exemplo;
  depois, uma linha do tempo: cada etapa diz o nome e o que acontece com o
  exemplo ali; no fim, o que sai. Sem diagrama de blocos e sem controles:
  rola e lê, e as etapas entram uma a uma.
*/

export function Walkthrough({ data }: { data: WalkthroughData }) {
  return (
    <div className="vz-wt">
      <figure className="vz-wt-example" data-reveal="fade" data-delay="60">
        <figcaption className="vz-wt-source" data-illustrative={data.illustrative ? "" : undefined}>
          {data.illustrative ? "Example" : "Example from the paper"}
        </figcaption>
        <p className="vz-wt-input">{data.input}</p>
      </figure>

      <ol className="vz-wt-steps">
        {data.stages.map((s, i) => (
          <li key={i} className="vz-wt-step" data-reveal="fade" data-delay="auto">
            <span className="vz-wt-num tnum" aria-hidden="true">
              {i + 1}
            </span>
            <h3 className="vz-wt-title">{s.title}</h3>
            <p className="vz-wt-ex" data-format={s.example_format}>
              {s.example}
            </p>
          </li>
        ))}
        <li className="vz-wt-step" data-out="" data-reveal="fade" data-delay="auto">
          <span className="vz-wt-num" aria-hidden="true">
            <Icon name="arrow-right" />
          </span>
          <h3 className="vz-wt-title">What comes out</h3>
          <p className="vz-wt-ex">{data.output}</p>
        </li>
      </ol>
    </div>
  );
}
