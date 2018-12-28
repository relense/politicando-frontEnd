import React, { Component } from 'react';
import { connect } from 'react-redux';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import './ArticleDiscussion.css';
import { asyncLoadArticle, asyncLoadArticleComments, setEditorIndex } from '../../redux/actions/articleActions';
import LatestNewsSingleContainer from '../latestNewsSingleContainer/LatestNewsSingleContainer.js';
import Comment from '../comment/Comment.js';
import { asyncChangeView, asyncCloseDrawer } from '../../redux/actions/viewActions';
import { asyncChangeCurrentPartie } from '../../redux/actions/partiesActions';
import { checkDarkModeBackground } from '../../utils/CheckDarkMode.js';
import CustomEditor from '../customEditor/CustomEditor.js';


class ArticleDiscussion extends Component {
  componentDidMount() {
    if(this.props.currentArticle === null)
      this.props.getArticle(this.props.id)

    this.props.getArticleComments(this.props.id);

    if(this.props.currentView !== "COMMENTS") {
      this.props.changeView("COMMENTS");
      this.props.changeCurrentPartie("");
    }
  }

  setArticleContainer = () => {
    return this.props.currentArticle !== null ? <LatestNewsSingleContainer  article={this.props.currentArticle}/> : <LatestNewsSingleContainer />
  }

  setArticleComments = (comments) => {
    if(comments !== null) 
      return comments.map((item) => (
          <Comment comment={item} 
                    key={item.id}  
                    commentId={item.id} 
                    editorIndexState={this.props.editorIndex === item.id ? true : false }
          />
        ))
    else 
      return null
  }

  render() {
    let renderer;

    if(this.props.currentArticle !== null && this.props.currentArticle !== undefined) {
      const articleContainer = this.setArticleContainer();
      renderer = (
        <div className={'articleDiscussionMainContainer' + checkDarkModeBackground(this.props.darkMode)} onClick={this.props.drawer ? this.props.closeDrawer : null}>
          <div className={(this.props.drawer ? ' mainContainerDark removeLinks' : '')}>
            <div className={'articleContainer'}>
              {articleContainer}
            </div>
            <CustomEditor 
              articleId={this.props.currentArticle.id}
              commentType={"post"}
              commentId={null}
            />
            <div className="commentsContainer">
              {this.setArticleComments(this.props.comments)}
            </div> 
          </div>         
        </div>
      )
    } else {
      renderer = null;
    }

    return renderer
 
  }
}

function mapStateToProps(state) {
  return {
    darkMode: state.view.darkMode,
    currentArticle: state.article.currentArticle,
    comments: state.article.currentArticleComments,
    currentView: state.view.currentView,
    drawer: state.view.drawer,
    editorIndex: state.article.editorIndex,
  };
}

function mapDispatchToProps(dispatch) {
  return {     
    getArticle: (article_id) => {
      dispatch(asyncLoadArticle(article_id))
    },
    getArticleComments: (article_id) => {
      dispatch(asyncLoadArticleComments(article_id))
    },
    changeView: (view) => {
      dispatch(asyncChangeView(view))
    },
    changeCurrentPartie: (partie) => {
      dispatch(asyncChangeCurrentPartie(partie))
    },
    closeDrawer: () => {
      dispatch(asyncCloseDrawer());
    },
    changeEditorIndex: (index) => {
      dispatch(setEditorIndex(index));
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ArticleDiscussion);
