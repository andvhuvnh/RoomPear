import React, { createContext, useContext } from 'react';

type TabBadgesContextValue = {
  /** Re-runs MainTab badge queries (pending likes + unread). */
  refreshTabBadges: () => void;
};

const TabBadgesContext = createContext<TabBadgesContextValue>({
  refreshTabBadges: () => {},
});

export function TabBadgesProvider({
  children,
  refreshTabBadges,
}: {
  children: React.ReactNode;
  refreshTabBadges: () => void;
}) {
  return (
    <TabBadgesContext.Provider value={{ refreshTabBadges }}>
      {children}
    </TabBadgesContext.Provider>
  );
}

export function useTabBadges(): TabBadgesContextValue {
  return useContext(TabBadgesContext);
}
