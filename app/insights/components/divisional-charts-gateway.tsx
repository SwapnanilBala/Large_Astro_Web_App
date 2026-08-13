import Link from "next/link";
import { FiArrowUpRight, FiClock, FiLayers } from "react-icons/fi";
import { IMPORTANT_DIVISIONAL_CHARTS } from "@/lib/divisional-chart-guide";
import styles from "./divisional-charts-gateway.module.css";

type DivisionalChartsGatewayProps = {
  href: string;
  chartCount: number;
};

export default function DivisionalChartsGateway({
  href,
  chartCount,
}: DivisionalChartsGatewayProps) {
  return (
    <div className={styles.gateway}>
      <div className={styles.copy}>
        <span className={styles.icon} aria-hidden="true">
          <FiLayers />
        </span>
        <div>
          <h3>See the layers behind your main chart</h3>
          <p>
            Explore all {chartCount} supported vargas from D1 through D60, with
            clear guidance for the ten charts that matter most in a client reading.
          </p>
        </div>
      </div>

      <div className={styles.keyCharts} aria-label="Ten key divisional charts">
        {IMPORTANT_DIVISIONAL_CHARTS.map((chart) => (
          <span key={chart.division} title={chart.focus}>
            <strong>{chart.label}</strong>
            {chart.name}
          </span>
        ))}
      </div>

      <div className={styles.footer}>
        <p>
          <FiClock aria-hidden="true" />
          Higher divisions are shown with birth-time reliability guidance.
        </p>
        <Link href={href} className={styles.openLink}>
          Open your varga atlas
          <FiArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
