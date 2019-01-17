import { GET_ARTICLE, GET_ARTICLE_COMMENTS, SET_COMMENT, SET_EDITOR_INDEX, SET_REPLY } from '../actions/actionTypes';

const initialState = {
  currentArticle: null,
  currentArticleComments: null,
  enters: 0,
  characters: 0,
  max: 300,
  comment: {},
  editorIndex: null,
  reply: false,
}

export default function article(state = initialState, action) {
  switch (action.type) {
    case GET_ARTICLE:
      return {
        ...state,
        currentArticle: action.currentArticle
      }

    case GET_ARTICLE_COMMENTS:
      return {
        ...state,
        currentArticleComments: action.currentArticleComments
      }

    case SET_COMMENT:
      return {
        ...state,
        comment: action.comment,
      }

    case SET_EDITOR_INDEX:
      return {
        ...state,
        editorIndex: action.editorIndex
      }

    case SET_REPLY:
      return {
        ...state,
        reply: action.reply
      }
    
    default:
      return state;
  }
}