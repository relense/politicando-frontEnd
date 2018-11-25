import * as types from './actionTypes';

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

export const asyncChangeView = (view) => {
  return async function(dispatch) {
    try {
      dispatch(changeView(view))
    } catch(error) {
      console.log(error)
    }
  }
}

export const asyncChangePartyView = (view) => {
  return async function(dispatch) {
    try {
      dispatch(changePartyView(view))
    } catch(error) {
      console.log(error)
    }
  }
}

export const asyncOpenDrawer = () => {
  return async function(dispatch) {
    try {
      dispatch(openDrawer())
    } catch(error) {
      console.log(error)
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
