import * as types from './actionTypes';
import { setPartieLoading } from './partiesActions';

export function changeView(view) {
  return {
    type: types.SET_VIEW,
    view: view
  };
}

export function changePartyView(view) {
  return {
    type: types.SET_PARTY_VIEW,
    partyView: view
  };
}

export function openDrawer() {
  return {
    type: types.OPEN_DRAWER,
    drawer: false
  }
}

export function closeDrawer() {
  return {
    type: types.CLOSE_DRAWER,
    drawer: true
  }
}

export function setDarkMode(darkMode) {
  return {
    type: types.SET_DARK_MODE,
    darkMode: darkMode === "false" ? false : true
  }
}

export function darkMode() {
  return {
    type: types.DARK_MODE
  }
}

export const asyncChangeView = (view) => {
  return async function(dispatch) {
    try {
      dispatch(setPartieLoading(true));
      dispatch(changeView(view))
    } catch(error) {
      console.log(error)
    } finally {
      dispatch(setPartieLoading(false));
    }
  }
}

export const asyncChangePartyView = (view) => {
  return async function(dispatch) {
    try {
      dispatch(setPartieLoading(true));
      dispatch(changePartyView(view));
    } catch(error) {
      console.log(error);
    } finally {
      dispatch(setPartieLoading(false));
    }
  }
}

export const asyncOpenDrawer = () => {
  return async function(dispatch) {
    try {
      dispatch(openDrawer());
    } catch(error) {
      console.log(error);
    }
  }
}

export const asyncCloseDrawer = () => {
  return async function(dispatch) {
    try {
      dispatch(closeDrawer())
    } catch(error) {
      console.log(error)
    }
  }
}

export const asyncChangeDarkMode = () => {
  return async function(dispatch) {
    try {
      dispatch(darkMode())
    } catch(error) {
      console.log(error)
    }
  }
}
