import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colors, overlays, radius, semanticColors, spacing, typography } from '../../../theme/tokens';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Image,
    TouchableOpacity,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { getPracticeDriverDetail } from '../../../../backend/service/openf1Service';
import PracticeStatsSection from '../../../component/practice/PracticeStatsSection';
import StintCard from '../../../component/common/StintCard';
import type { DriverOption } from '../../../component/practice/FreePracticeResultCard';
import type { SessionDriverData, SessionResult } from '../../../../backend/types';
import { groupLapsByStints } from '../../../../utils/lap';
import {
    getTeamColorHex,
    getDriverInitials,
    formatSessionGap,
    formatSessionResult,
    getResultStatusLabel,
} from '../../../../utils/driver';

type RouteParams = {
    driverNumber: number;
    sessionKey: number;
    driverData?: SessionDriverData | null;
    driverOptions?: DriverOption[];
};

interface DriverState {
    driverData: SessionDriverData | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
}

const DATA_NOT_YET_AVAILABLE = 'Data not yet available';

const asDisplayText = (value: string | null | undefined, fallback = DATA_NOT_YET_AVAILABLE) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : fallback;
};

export default function DriverPracticeDetailsScreen() {
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const {
        driverNumber,
        sessionKey,
        driverData: driverDataParam,
        driverOptions: driverOptionsParam,
    } = route.params;
    const driverOptions = driverOptionsParam ?? [];
    const [selectedDriverNumber, setSelectedDriverNumber] = useState(driverNumber);
    const [isDriverListOpen, setIsDriverListOpen] = useState(false);

    const [state, setState] = useState<DriverState>({
        driverData: driverDataParam ?? null,
        loading: !driverDataParam,
        refreshing: false,
        error: null,
    });
    const requestIdRef = useRef(0);

    const fetchDriver = useCallback(
        async (targetDriver: number, isRefresh = false) => {
            const requestId = ++requestIdRef.current;
            setState(prev => {
                const shouldShowLoading = !isRefresh && !prev.driverData;
                return {
                    ...prev,
                    loading: shouldShowLoading,
                    refreshing: isRefresh,
                    error: null,
                };
            });

            try {
                const detail = await getPracticeDriverDetail(sessionKey, targetDriver);
                if (requestId !== requestIdRef.current) {
                    return;
                }
                setState({
                    driverData: detail,
                    loading: false,
                    refreshing: false,
                    error: detail ? null : 'Driver data not found for this session',
                });
                if (detail?.driverNumber === targetDriver) {
                    setSelectedDriverNumber(targetDriver);
                }
            } catch (error) {
                if (requestId !== requestIdRef.current) {
                    return;
                }
                setState({
                    driverData: null,
                    loading: false,
                    refreshing: false,
                    error: error instanceof Error ? error.message : 'Failed to load driver data',
                });
            }
        },
        [sessionKey]
    );

    useEffect(() => {
        if (state.driverData?.driverNumber === selectedDriverNumber) {
            return;
        }
        fetchDriver(selectedDriverNumber);
    }, [selectedDriverNumber, fetchDriver, state.driverData?.driverNumber]);

    const handleRefresh = useCallback(
        () => fetchDriver(selectedDriverNumber, true),
        [fetchDriver, selectedDriverNumber]
    );

    const handleSelectDriver = useCallback(
        (optionNumber: number) => {
            if (optionNumber === selectedDriverNumber) {
                setIsDriverListOpen(false);
                return;
            }
            setSelectedDriverNumber(optionNumber);
            setIsDriverListOpen(false);
        },
        [selectedDriverNumber]
    );

    const selectedDriverOption = useMemo(() => {
        return (
            driverOptions.find(option => option.driverNumber === selectedDriverNumber) ?? null
        );
    }, [driverOptions, selectedDriverNumber]);

    const driverData = state.driverData;
    const [stintsExpanded, setStintsExpanded] = useState(true);
    const pitInLapSet = useMemo(() => {
        if (!driverData) return new Set<number>();
        return new Set(
            driverData.laps
                .filter(lap => lap.is_pit_out_lap)
                .map(lap => lap.lap_number - 1)
                .filter(lapNumber => lapNumber > 0)
        );
    }, [driverData]);

    const stintsWithLaps = useMemo(() => {
        if (!driverData) {
            return [];
        }
        return groupLapsByStints(driverData.laps, driverData.stints);
    }, [driverData]);

    if (state.loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={semanticColors.danger} />
                <Text style={styles.loadingText}>Loading driver data...</Text>
            </View>
        );
    }

    if (state.error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Unable to Load Driver</Text>
                <Text style={styles.errorMessage}>{state.error || 'No data available'}</Text>
            </View>
        );
    }

    if (!driverData) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorTitle}>Driver Not Found</Text>
                <Text style={styles.errorMessage}>No data available for this driver.</Text>
            </View>
        );
    }

    const headerColor = getTeamColorHex(driverData.driver.teamColor);
    const driverImageSource = driverData.driver.headshotUrl
        ? { uri: driverData.driver.headshotUrl }
        : null;
    const sessionResult = driverData.sessionResult;
    const safeDriverName = asDisplayText(driverData.driver.name);
    const safeTeamName = asDisplayText(driverData.driver.team);
    const safeDriverNumber =
        typeof driverData.driver.number === 'number'
            ? `#${driverData.driver.number}`
            : DATA_NOT_YET_AVAILABLE;
    const heroStats = [
        {
            label: 'Result',
            value: formatSessionResult(sessionResult),
        },
        {
            label: 'Laps',
            value: sessionResult?.number_of_laps ?? driverData.laps.length,
        },
        {
            label: 'Gap',
            value: formatSessionGap(sessionResult?.gap_to_leader ?? null),
        },
    ];

    const statusLabel = getResultStatusLabel(sessionResult, 'Practice Run');

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={state.refreshing}
                    onRefresh={handleRefresh}
                    tintColor={semanticColors.danger}
                />
            }
        >
            {driverOptions.length > 0 && (
                <View style={styles.driverSelectorContainer}>
                    <TouchableOpacity
                        style={[
                            styles.driverSelectorField,
                            isDriverListOpen && styles.driverSelectorFieldOpen,
                        ]}
                        activeOpacity={0.88}
                        onPress={() => setIsDriverListOpen(prev => !prev)}
                    >
                        <View style={styles.driverSelectorLabelWrap}>
                            <Text style={styles.driverSelectorName}>
                                {asDisplayText(
                                    selectedDriverOption?.name,
                                    `Driver #${selectedDriverNumber}`
                                )}
                            </Text>
                            <Text style={styles.driverSelectorMeta}>
                                {asDisplayText(selectedDriverOption?.team, 'Choose driver')}
                            </Text>
                        </View>
                        <Text style={styles.driverSelectorCaret}>
                            {isDriverListOpen ? '▲' : '▼'}
                        </Text>
                    </TouchableOpacity>
                    {isDriverListOpen && (
                        <ScrollView
                            style={styles.driverSelectorList}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                        >
                            {driverOptions.map(option => {
                                const isActive = option.driverNumber === selectedDriverNumber;
                                return (
                                    <TouchableOpacity
                                        key={option.driverNumber}
                                        style={[
                                            styles.driverOptionRow,
                                            isActive && styles.driverOptionRowActive,
                                        ]}
                                        activeOpacity={0.85}
                                        onPress={() => handleSelectDriver(option.driverNumber)}
                                    >
                                        <View style={styles.driverOptionInfo}>
                                            <Text
                                                style={[
                                                    styles.driverOptionName,
                                                    isActive && styles.driverOptionNameActive,
                                                ]}
                                            >
                                                {asDisplayText(option.name)}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.driverOptionMeta,
                                                    isActive && styles.driverOptionMetaActive,
                                                ]}
                                            >
                                                {asDisplayText(option.team)}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.driverOptionNumber,
                                                isActive && styles.driverOptionNumberActive,
                                            ]}
                                        >
                                            #{option.driverNumber}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            )}
            <View style={[styles.heroCard, { backgroundColor: headerColor }]}>
                <View style={styles.heroRow}>
                    <View style={styles.heroTextBlock}>
                        <Text style={styles.heroSubtitle}>Free Practice</Text>
                        <Text style={styles.heroName}>{safeDriverName}</Text>
                        <Text style={styles.heroTeam}>{safeTeamName}</Text>
                        <View style={styles.heroChipRow}>
                            <View style={styles.heroChip}>
                                <Text style={styles.heroChipText}>{safeDriverNumber}</Text>
                            </View>
                            <View style={[styles.heroChip, styles.heroChipMuted]}>
                                <Text style={[styles.heroChipText, styles.heroChipTextMuted]}>
                                    {statusLabel}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.heroAvatar}>
                        {driverImageSource ? (
                            <Image source={driverImageSource} style={styles.heroImage} />
                        ) : (
                            <Text style={styles.avatarInitials}>
                                {getDriverInitials(safeDriverName)}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={styles.heroStatRow}>
                    {heroStats.map(stat => (
                        <View key={stat.label} style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{stat.value}</Text>
                            <Text style={styles.heroStatLabel}>{stat.label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <PracticeStatsSection
                lapCount={driverData.laps.length}
                stints={driverData.stints}
                laps={driverData.laps}
            />

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>Stints & Laps</Text>
                        <Text style={styles.sectionSubtitle}>Tyre evolution and stint detail</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.sectionToggle}
                        onPress={() => setStintsExpanded(prev => !prev)}
                    >
                        <Text style={styles.sectionToggleText}>
                            {stintsExpanded ? 'Hide' : 'Show'}
                        </Text>
                    </TouchableOpacity>
                </View>
                {stintsExpanded ? (
                    stintsWithLaps.length > 0 ? (
                        stintsWithLaps.map(({ stint, laps }, index) => (
                            <StintCard
                                key={stint.stint_number}
                                stint={stint}
                                laps={laps}
                                showDivider={index < stintsWithLaps.length - 1}
                                pitInLapSet={pitInLapSet}
                            />
                        ))
                    ) : (
                        <Text style={styles.noData}>No stints recorded for this session</Text>
                    )
                ) : null}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: semanticColors.background,
    },
    contentContainer: {
        paddingBottom: spacing.xxl,
    },
    driverSelectorContainer: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
    },
    driverSelectorField: {
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: '#D9DEEC',
        backgroundColor: semanticColors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    driverSelectorFieldOpen: {
        borderColor: '#BFC6DF',
        borderBottomLeftRadius: radius.sm,
        borderBottomRightRadius: radius.sm,
    },
    driverSelectorLabelWrap: {
        flex: 1,
        paddingRight: spacing.md,
    },
    driverSelectorName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textPrimary,
    },
    driverSelectorMeta: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    driverSelectorCaret: {
        fontSize: typography.size.sm,
        color: semanticColors.textSecondary,
        fontWeight: typography.weight.bold,
    },
    driverSelectorList: {
        maxHeight: 280,
        marginTop: spacing.xxs,
        borderWidth: 1,
        borderColor: '#D9DEEC',
        borderRadius: radius.lg,
        backgroundColor: semanticColors.surface,
    },
    driverOptionRow: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E6E9F4',
    },
    driverOptionRowActive: {
        backgroundColor: '#F5F6FB',
    },
    driverOptionInfo: {
        flex: 1,
        paddingRight: spacing.sm,
    },
    driverOptionName: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.semibold,
        color: semanticColors.textPrimary,
    },
    driverOptionNameActive: {
        color: semanticColors.textPrimary,
    },
    driverOptionMeta: {
        marginTop: 2,
        fontSize: typography.size.sm,
        color: semanticColors.textMuted,
    },
    driverOptionMetaActive: {
        color: semanticColors.textSecondary,
    },
    driverOptionNumber: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: '#6D7390',
    },
    driverOptionNumberActive: {
        color: semanticColors.textPrimary,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: semanticColors.background,
    },
    loadingText: {
        marginTop: spacing.sm,
        fontSize: typography.size.lg,
        color: semanticColors.textSecondary,
    },
    errorTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.danger,
        marginBottom: spacing.xs,
    },
    errorMessage: {
        fontSize: typography.size.lg,
        color: semanticColors.textSecondary,
        textAlign: 'center',
    },
    heroCard: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.xxl,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },
    heroRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroTextBlock: {
        flex: 1,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: typography.size.sm,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    heroName: {
        color: semanticColors.surface,
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.heavy,
        marginTop: spacing.xs,
    },
    heroTeam: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: typography.size.base,
        marginTop: spacing.xxs,
    },
    heroChipRow: {
        flexDirection: 'row',
        marginTop: spacing.md,
    },
    heroChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: overlays.white16,
        marginRight: spacing.sm,
    },
    heroChipMuted: {
        backgroundColor: overlays.white08,
    },
    heroChipText: {
        color: semanticColors.surface,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.sm,
        letterSpacing: typography.letterSpacing.wide,
    },
    heroChipTextMuted: {
        color: 'rgba(255,255,255,0.85)',
        fontWeight: typography.weight.semibold,
    },
    heroAvatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
        marginLeft: spacing.md,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    avatarInitials: {
        fontSize: typography.size.xxxl,
        fontWeight: typography.weight.bold,
        color: semanticColors.surface,
    },
    heroStatRow: {
        flexDirection: 'row',
        marginTop: spacing.xl,
        backgroundColor: 'rgba(0,0,0,0.18)',
        borderRadius: radius.xl,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    heroStat: {
        flex: 1,
        alignItems: 'center',
    },
    heroStatValue: {
        color: semanticColors.surface,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
    },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.size.sm,
        letterSpacing: 0.7,
        marginTop: spacing.xxs,
        textTransform: 'uppercase',
    },
    section: {
        marginTop: spacing.lg,
        marginHorizontal: spacing.md,
        backgroundColor: semanticColors.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        shadowColor: colors.neutral.black,
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4,
    },
    sectionHeader: {
        marginBottom: spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: semanticColors.textPrimary,
    },
    sectionSubtitle: {
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
        marginTop: spacing.xxs,
    },
    sectionToggle: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        backgroundColor: '#EFF0F7',
    },
    sectionToggleText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: semanticColors.textSecondary,
    },
    noData: {
        fontSize: typography.size.base,
        color: semanticColors.textMuted,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: spacing.md,
    },
});
