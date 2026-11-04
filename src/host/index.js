/**
 * monitor-bi-dsh host plugin entry. Default-exported Service class; the loader
 * constructs it with (ctx, config) and registers it under the `monitorbi` key.
 */
import { MonitorBiService, applyRemoteDecorators } from './service.js';

applyRemoteDecorators();

export default MonitorBiService;
export { MonitorBiService };
