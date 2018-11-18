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
