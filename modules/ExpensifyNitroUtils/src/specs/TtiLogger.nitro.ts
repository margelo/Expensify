import type {HybridObject} from 'react-native-nitro-modules';

type TtiMeasurementName = 'applicationStartup' | 'bundleExecution' | 'firstDraw';

type TtiMeasurementValue = Record<TtiMeasurementName, number>;

type OnMeasurementsReadyListener = (measurement: TtiMeasurementValue) => void;

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
interface TtiLogger extends HybridObject<{ios: 'swift'; android: 'kotlin'}> {
    mark(name: TtiMeasurementName, timestamp: number): void;

    addMeasurementsReadyListener(onMeasurementsReadyListener: OnMeasurementsReadyListener): number;

    removeMeasurementsReadyListener(listenerId: number): void;

    getMeasurements(): TtiMeasurementValue | undefined;
}

export default TtiLogger;
export type {TtiMeasurementValue, OnMeasurementsReadyListener};
