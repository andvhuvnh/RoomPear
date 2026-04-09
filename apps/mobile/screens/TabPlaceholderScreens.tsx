import { StyleSheet, Text, View } from 'react-native';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    color: '#333',
  },
});

export function TabPlaceholder({ title }: { title: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}

export function DiscoverSwipePlaceholder() {
  return <TabPlaceholder title="Home (Discover / Swipe)" />;
}

export function MatchesPlaceholder() {
  return <TabPlaceholder title="Matches" />;
}
