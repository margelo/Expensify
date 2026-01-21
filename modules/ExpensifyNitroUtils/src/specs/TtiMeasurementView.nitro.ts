import type {HybridView, HybridViewMethods, HybridViewProps} from 'react-native-nitro-modules';
import type {OnMeasurementsReadyListener} from './TtiLogger.nitro';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type
interface TtiMeasurementViewProps extends HybridViewProps {
    onMeasurementsReady?: OnMeasurementsReadyListener;
}

type TtiMeasurementViewMethods = HybridViewMethods;

type TtiMeasurementView = HybridView<TtiMeasurementViewProps, TtiMeasurementViewMethods>;

export type {TtiMeasurementView, TtiMeasurementViewProps, TtiMeasurementViewMethods};
export {default as TtiMeasurementViewConfig} from '../../nitrogen/generated/shared/json/TtiMeasurementViewConfig.json';
