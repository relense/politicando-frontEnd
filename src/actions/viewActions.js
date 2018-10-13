import * as types from './actionTypes';

export function changeView(view) {
  return {
    type: types.SET_VIEW,
    view: view
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
