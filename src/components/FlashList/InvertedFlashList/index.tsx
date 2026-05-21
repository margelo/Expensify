import type {LegendListProps} from '@legendapp/list/react-native';
import {LegendList} from '@legendapp/list/react-native';
import React from 'react';
import type {LegendListRefType} from '@pages/inbox/ReportScreenContext';

// import CellRendererComponent from './CellRendererComponent';

type InvertedFlashListProps<T> = LegendListProps<T> & {
    /** The array of items to render in the list. */
    data: T[];

    /** Key of the item to initially scroll to when the list first renders. */
    initialScrollKey?: string | null;

    /** Ref to the underlying list instance. */
    ref: LegendListRefType | null;
};

function InvertedFlashList<T>({data, keyExtractor, initialScrollKey, initialScrollIndex: initialScrollIndexProp, ...restProps}: InvertedFlashListProps<T>) {
    const targetIndex = initialScrollKey == null ? -1 : data.findIndex((item, index) => keyExtractor?.(item, index) === initialScrollKey);
    const initialScrollIndexForKey = targetIndex < 0 ? undefined : targetIndex;
    const initialScrollIndex = initialScrollIndexProp ?? initialScrollIndexForKey;

    return (
        <LegendList<T>
            {...restProps}
            data={data}
            keyExtractor={keyExtractor}
            initialScrollIndex={initialScrollIndex ? {index: initialScrollIndex as number, viewPosition: 0.5} : undefined}
            // CellRendererComponent={CellRendererComponent}
        />
    );
}

export default InvertedFlashList;
