import React, { Component } from 'react';
import { connect } from 'react-redux';
import './LatestNews.css';
import LatestNewsSingleContainer from '../latestNewsSingleContainer/LatestNewsSingleContainer';
import { checkDarkModeBackground } from '../../utils/CheckDarkMode.js';
import { ClipLoader } from 'react-spinners';

class LatestNews extends Component {

  renderItem = () => {
    var data = [];

    if (this.props.articles === 0 || this.props.articles === undefined) return;

    for(let i = 0; i < this.props.articles.length; i++){
      data.push(
        <div key={"doubleContainer" + i} className="latestNewsDoubleContainer">
          <LatestNewsSingleContainer key={"newsContainer" + i} article={this.props.articles[i]}/>
        </div>
      )
    }
    return data;
  }

  render() {
    return (
      <div className={'latestNewsMainContainer' + checkDarkModeBackground(this.props.darkMode)}>
        {this.renderItem()}
        {this.props.loading === true &&
          <div className="centerLoader">
            <ClipLoader
              css={`display: block; justify-content: center; border-color: red;`}
              sizeUnit={"px"}
              size={30}
              color={'#123abc'} 
            />
          </div>
        }
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    darkMode: state.view.darkMode,
    loading: state.articles.loading
  };
}

function mapDispatchToProps(dispatch) {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LatestNews);