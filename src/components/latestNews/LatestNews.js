import React, { Component } from 'react';
import LatestNewsSingleContainer from './LatestNewsSingleContainer';

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
          <div className="latestNewsMainContainer">
            {this.renderItem()}
          </div>
        );
    }
}


export default LatestNews;
