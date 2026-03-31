import { WIDGET_REGISTRY } from '../config/widgetRegistry';
import './WidgetContainer.css';

export default function WidgetContainer({ dateRange, enabledWidgets, data, loading, error }) {
  return (
    <div className="widget-container">
      <div className="widgets-grid">
        {enabledWidgets.map((widgetType) => {
          const config = WIDGET_REGISTRY[widgetType];
          if (!config) {
            console.warn(`Unknown widget type: ${widgetType}`);
            return null;
          }

          const WidgetComponent = config.component;
          const widgetData = data ? data[config.dataKey] : null;

          return (
            <div
              key={widgetType}
              className={`widget-grid-item widget-size-${config.size}`}
            >
              <WidgetComponent
                data={widgetData}
                loading={loading}
                error={error}
                dateRange={dateRange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
